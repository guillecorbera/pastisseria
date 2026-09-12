import crypto from 'node:crypto'
import { getConnection } from './db.js'

const DEFAULT_AUDIT_SECRET = 'dev-audit-secret-change-me'

function getAuditSecret() {
  return `${process.env.TIME_TRACKING_AUDIT_SECRET ?? DEFAULT_AUDIT_SECRET}`
}

export function assertTimeTrackingSecurityConfiguration() {
  if (!process.env.VERCEL) {
    return
  }

  const auditSecret = `${process.env.TIME_TRACKING_AUDIT_SECRET ?? ''}`
  const terminalKey = `${process.env.TIME_TRACKING_TERMINAL_KEY ?? ''}`

  if (auditSecret.length < 32 || terminalKey.length < 32) {
    throw new Error(
      'Configura TIME_TRACKING_AUDIT_SECRET y TIME_TRACKING_TERMINAL_KEY con al menos 32 caracteres.',
    )
  }
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key])
        return result
      }, {})
  }

  return value
}

function buildHashPayload(event) {
  return JSON.stringify(
    canonicalize({
      eventUuid: event.eventUuid,
      employeeId: Number(event.employeeId),
      shiftId: Number(event.shiftId),
      eventType: event.eventType,
      occurredAt: normalizeTimestamp(event.occurredAt),
      recordedAt: normalizeTimestamp(event.recordedAt),
      verificationMethod: `${event.verificationMethod}`,
      deviceId: `${event.deviceId ?? ''}`,
      actorType: `${event.actorType}`,
      actorId: `${event.actorId ?? ''}`,
      requestId: `${event.requestId}`,
      previousHash: `${event.previousHash ?? ''}`,
      payload: event.payload ?? {},
    }),
  )
}

export function calculateTimeEventHash(event) {
  return crypto
    .createHmac('sha256', getAuditSecret())
    .update(buildHashPayload(event))
    .digest('hex')
}

export async function appendTimeTrackingEvent(connection, input) {
  const previousResult = await connection.query(
    `SELECT event_hash AS "eventHash"
     FROM employee_time_events
     WHERE employee_id = :employeeId
     ORDER BY id DESC
     LIMIT 1`,
    { employeeId: input.employeeId },
  )
  const event = {
    eventUuid: input.eventUuid ?? crypto.randomUUID(),
    employeeId: Number(input.employeeId),
    shiftId: Number(input.shiftId),
    eventType: input.eventType,
    occurredAt: normalizeTimestamp(input.occurredAt),
    recordedAt: normalizeTimestamp(input.recordedAt ?? new Date()),
    verificationMethod: `${input.verificationMethod}`,
    deviceId: `${input.deviceId ?? ''}`,
    actorType: `${input.actorType}`,
    actorId: `${input.actorId ?? ''}`,
    requestId: `${input.requestId ?? crypto.randomUUID()}`,
    previousHash: previousResult.rows[0]?.eventHash ?? '',
    payload: input.payload ?? {},
  }
  const eventHash = calculateTimeEventHash(event)

  await connection.query(
    `INSERT INTO employee_time_events (
      event_uuid,
      employee_id,
      shift_id,
      event_type,
      occurred_at,
      recorded_at,
      verification_method,
      device_id,
      actor_type,
      actor_id,
      request_id,
      previous_hash,
      event_hash,
      payload
    ) VALUES (
      :eventUuid,
      :employeeId,
      :shiftId,
      :eventType,
      :occurredAt,
      :recordedAt,
      :verificationMethod,
      :deviceId,
      :actorType,
      :actorId,
      :requestId,
      :previousHash,
      :eventHash,
      :payload::jsonb
    )`,
    {
      ...event,
      eventHash,
      payload: JSON.stringify(event.payload),
    },
  )

  return { ...event, eventHash }
}

export async function backfillTimeTrackingEvents() {
  const connection = await getConnection()

  try {
    await connection.query('BEGIN')
    const result = await connection.query(
      `SELECT
        s.id AS "shiftId",
        s.employee_id AS "employeeId",
        s.started_at AS "startedAt",
        s.ended_at AS "endedAt",
        s.verification_method AS "verificationMethod",
        s.ended_verification_method AS "endedVerificationMethod",
        s.device_id AS "deviceId",
        emp.name AS "employeeName",
        emp.tax_id AS "employeeTaxId",
        emp.social_security_number AS "employeeSocialSecurityNumber"
       FROM employee_shifts s
       INNER JOIN employees emp ON emp.id = s.employee_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM employee_time_events e
         WHERE e.shift_id = s.id
           AND e.event_type = 'checkin'
       )
       ORDER BY s.employee_id, s.started_at, s.id`,
    )

    for (const shift of result.rows) {
      await connection.query('SELECT pg_advisory_xact_lock(:employeeId)', {
        employeeId: shift.employeeId,
      })
      await appendTimeTrackingEvent(connection, {
        employeeId: shift.employeeId,
        shiftId: shift.shiftId,
        eventType: 'checkin',
        occurredAt: shift.startedAt,
        verificationMethod: shift.verificationMethod ?? 'legacy',
        deviceId: shift.deviceId,
        actorType: 'migration',
        actorId: 'bootstrap',
        requestId: `legacy-checkin-${shift.shiftId}`,
        payload: {
          importedFromLegacyShift: true,
          employee: {
            name: shift.employeeName,
            taxId: shift.employeeTaxId,
            socialSecurityNumber: shift.employeeSocialSecurityNumber,
          },
        },
      })

      if (shift.endedAt) {
        await appendTimeTrackingEvent(connection, {
          employeeId: shift.employeeId,
          shiftId: shift.shiftId,
          eventType: 'checkout',
          occurredAt: shift.endedAt,
          verificationMethod:
            shift.endedVerificationMethod ?? shift.verificationMethod ?? 'legacy',
          deviceId: shift.deviceId,
          actorType: 'migration',
          actorId: 'bootstrap',
          requestId: `legacy-checkout-${shift.shiftId}`,
          payload: {
            importedFromLegacyShift: true,
            employee: {
              name: shift.employeeName,
              taxId: shift.employeeTaxId,
              socialSecurityNumber: shift.employeeSocialSecurityNumber,
            },
          },
        })
      }
    }

    await connection.query('COMMIT')
    return result.rows.length
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally {
    connection.release()
  }
}

export async function verifyTimeTrackingEventChain(connection, employeeId) {
  const result = await connection.query(
    `SELECT
      event_uuid AS "eventUuid",
      employee_id AS "employeeId",
      shift_id AS "shiftId",
      event_type AS "eventType",
      occurred_at AS "occurredAt",
      recorded_at AS "recordedAt",
      verification_method AS "verificationMethod",
      device_id AS "deviceId",
      actor_type AS "actorType",
      actor_id AS "actorId",
      request_id AS "requestId",
      previous_hash AS "previousHash",
      event_hash AS "eventHash",
      payload
     FROM employee_time_events
     WHERE employee_id = :employeeId
     ORDER BY id ASC`,
    { employeeId },
  )
  let previousHash = ''

  for (const event of result.rows) {
    const expectedHash = calculateTimeEventHash({ ...event, previousHash })

    if (event.previousHash !== previousHash || event.eventHash !== expectedHash) {
      return { valid: false, eventCount: result.rows.length, failedEvent: event.eventUuid }
    }

    previousHash = event.eventHash
  }

  return {
    valid: true,
    eventCount: result.rows.length,
    lastHash: previousHash,
  }
}
