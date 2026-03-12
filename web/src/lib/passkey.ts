function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeBase64Like(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function encodeBase64Url(input: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function parseTimeout(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

function parseAuthenticatorAttachment(
  value: unknown,
): AuthenticatorAttachment | undefined {
  if (value === 'platform' || value === 'cross-platform') {
    return value
  }
  return undefined
}

function parseResidentKey(value: unknown): ResidentKeyRequirement | undefined {
  if (
    value === 'required' ||
    value === 'preferred' ||
    value === 'discouraged'
  ) {
    return value
  }
  return undefined
}

function parseAttestationConveyancePreference(
  value: unknown,
): AttestationConveyancePreference | undefined {
  if (
    value === 'none' ||
    value === 'indirect' ||
    value === 'direct' ||
    value === 'enterprise'
  ) {
    return value
  }
  return undefined
}

function parseUserVerification(
  value: unknown,
): UserVerificationRequirement | undefined {
  if (
    value === 'required' ||
    value === 'preferred' ||
    value === 'discouraged'
  ) {
    return value
  }
  return undefined
}

function parseTransports(
  value: unknown,
): Array<AuthenticatorTransport> | undefined {
  if (!Array.isArray(value)) return undefined

  const transports = value.filter(
    (item): item is AuthenticatorTransport =>
      item === 'usb' ||
      item === 'nfc' ||
      item === 'ble' ||
      item === 'smart-card' ||
      item === 'hybrid' ||
      item === 'internal',
  )

  return transports.length > 0 ? transports : undefined
}

function parseAllowCredentials(
  value: unknown,
): Array<PublicKeyCredentialDescriptor> | undefined {
  if (!Array.isArray(value)) return undefined

  const parsed: Array<PublicKeyCredentialDescriptor> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = item.id
    if (typeof id !== 'string' || id.trim() === '') continue

    parsed.push({
      type: 'public-key',
      id: decodeBase64Like(id),
      transports: parseTransports(item.transports),
    })
  }

  return parsed.length > 0 ? parsed : undefined
}

function parsePublicKeyCredentialParameters(
  value: unknown,
): Array<PublicKeyCredentialParameters> {
  if (!Array.isArray(value)) {
    throw new Error('Passkey 创建参数缺失')
  }

  const parsed: Array<PublicKeyCredentialParameters> = []
  for (const item of value) {
    if (!isRecord(item)) continue

    const algRaw = item.alg
    const alg =
      typeof algRaw === 'number'
        ? algRaw
        : typeof algRaw === 'string' && algRaw.trim() !== ''
          ? Number(algRaw)
          : Number.NaN

    if (!Number.isFinite(alg)) continue

    parsed.push({
      type: 'public-key',
      alg,
    })
  }

  if (parsed.length === 0) {
    throw new Error('Passkey 创建参数缺失')
  }

  return parsed
}

function parseRpEntity(value: unknown): PublicKeyCredentialRpEntity {
  if (!isRecord(value)) {
    throw new Error('Passkey RP 配置缺失')
  }

  const name =
    typeof value.name === 'string' && value.name.trim() !== ''
      ? value.name
      : null
  if (!name) {
    throw new Error('Passkey RP 配置缺失')
  }

  const rp: PublicKeyCredentialRpEntity = { name }
  if (typeof value.id === 'string' && value.id.trim() !== '') {
    rp.id = value.id
  }

  return rp
}

function parseUserEntity(value: unknown): PublicKeyCredentialUserEntity {
  if (!isRecord(value)) {
    throw new Error('Passkey 用户信息缺失')
  }

  const idRaw = value.id
  if (typeof idRaw !== 'string' || idRaw.trim() === '') {
    throw new Error('Passkey 用户信息缺失')
  }

  const name =
    typeof value.name === 'string' && value.name.trim() !== ''
      ? value.name
      : null
  if (!name) {
    throw new Error('Passkey 用户信息缺失')
  }

  const displayNameRaw = value.displayName ?? value.display_name
  const displayName =
    typeof displayNameRaw === 'string' && displayNameRaw.trim() !== ''
      ? displayNameRaw
      : name

  return {
    id: decodeBase64Like(idRaw),
    name,
    displayName,
  }
}

function parseAuthenticatorSelection(
  value: unknown,
): AuthenticatorSelectionCriteria | undefined {
  if (!isRecord(value)) return undefined

  const selection: AuthenticatorSelectionCriteria = {}

  const attachment = parseAuthenticatorAttachment(
    value.authenticatorAttachment ?? value.authenticator_attachment,
  )
  if (attachment !== undefined) {
    selection.authenticatorAttachment = attachment
  }

  const residentKey = parseResidentKey(value.residentKey ?? value.resident_key)
  if (residentKey !== undefined) {
    selection.residentKey = residentKey
  }

  const requireResidentKeyRaw =
    value.requireResidentKey ?? value.require_resident_key
  if (typeof requireResidentKeyRaw === 'boolean') {
    selection.requireResidentKey = requireResidentKeyRaw
  }

  const userVerification = parseUserVerification(
    value.userVerification ?? value.user_verification,
  )
  if (userVerification !== undefined) {
    selection.userVerification = userVerification
  }

  return Object.keys(selection).length > 0 ? selection : undefined
}

function parseExcludeCredentials(
  value: unknown,
): Array<PublicKeyCredentialDescriptor> | undefined {
  if (!Array.isArray(value)) return undefined

  const parsed: Array<PublicKeyCredentialDescriptor> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = item.id
    if (typeof id !== 'string' || id.trim() === '') continue

    parsed.push({
      type: 'public-key',
      id: decodeBase64Like(id),
      transports: parseTransports(item.transports),
    })
  }

  return parsed.length > 0 ? parsed : undefined
}

function unwrapPublicKeyOptions(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Passkey challenge 无效')
  }

  if (isRecord(value.publicKey)) {
    return value.publicKey
  }

  return value
}

export function toPublicKeyCreationOptions(
  creationOptions: unknown,
): PublicKeyCredentialCreationOptions {
  const optionsSource = unwrapPublicKeyOptions(creationOptions)

  const challengeRaw = optionsSource.challenge
  if (typeof challengeRaw !== 'string' || challengeRaw.trim() === '') {
    throw new Error('Passkey challenge 缺失')
  }

  const options: PublicKeyCredentialCreationOptions = {
    challenge: decodeBase64Like(challengeRaw),
    rp: parseRpEntity(optionsSource.rp),
    user: parseUserEntity(optionsSource.user),
    pubKeyCredParams: parsePublicKeyCredentialParameters(
      optionsSource.pubKeyCredParams ?? optionsSource.pub_key_cred_params,
    ),
  }

  const timeout = parseTimeout(optionsSource.timeout)
  if (timeout !== undefined) {
    options.timeout = timeout
  }

  const attestation = parseAttestationConveyancePreference(
    optionsSource.attestation,
  )
  if (attestation !== undefined) {
    options.attestation = attestation
  }

  const authenticatorSelection = parseAuthenticatorSelection(
    optionsSource.authenticatorSelection ??
      optionsSource.authenticator_selection,
  )
  if (authenticatorSelection !== undefined) {
    options.authenticatorSelection = authenticatorSelection
  }

  const excludeCredentials = parseExcludeCredentials(
    optionsSource.excludeCredentials ?? optionsSource.exclude_credentials,
  )
  if (excludeCredentials !== undefined) {
    options.excludeCredentials = excludeCredentials
  }

  if (isRecord(optionsSource.extensions)) {
    options.extensions =
      optionsSource.extensions as AuthenticationExtensionsClientInputs
  }

  return options
}

export function toPublicKeyRequestOptions(
  assertionOptions: unknown,
): PublicKeyCredentialRequestOptions {
  const optionsSource = unwrapPublicKeyOptions(assertionOptions)

  const challengeRaw = optionsSource.challenge
  if (typeof challengeRaw !== 'string' || challengeRaw.trim() === '') {
    throw new Error('Passkey challenge 缺失')
  }

  const options: PublicKeyCredentialRequestOptions = {
    challenge: decodeBase64Like(challengeRaw),
  }

  const rpIdRaw = optionsSource.rpId ?? optionsSource.rp_id
  if (typeof rpIdRaw === 'string' && rpIdRaw.trim() !== '') {
    options.rpId = rpIdRaw
  }

  const timeoutRaw = optionsSource.timeout
  const timeout = parseTimeout(timeoutRaw)
  if (timeout !== undefined) {
    options.timeout = timeout
  }

  const userVerificationRaw =
    optionsSource.userVerification ?? optionsSource.user_verification
  const userVerification = parseUserVerification(userVerificationRaw)
  if (userVerification !== undefined) {
    options.userVerification = userVerification
  }

  const allowCredentialsRaw =
    optionsSource.allowCredentials ?? optionsSource.allow_credentials
  const allowCredentials = parseAllowCredentials(allowCredentialsRaw)
  if (allowCredentials !== undefined) {
    options.allowCredentials = allowCredentials
  }

  if (isRecord(optionsSource.extensions)) {
    options.extensions =
      optionsSource.extensions as AuthenticationExtensionsClientInputs
  }

  return options
}

function isAssertionResponse(
  value: AuthenticatorResponse,
): value is AuthenticatorAssertionResponse {
  return 'authenticatorData' in value && 'signature' in value
}

function isAttestationResponse(
  value: AuthenticatorResponse,
): value is AuthenticatorAttestationResponse {
  return 'attestationObject' in value
}

export function serializeAttestationCredential(
  credential: PublicKeyCredential,
): Record<string, unknown> {
  const response = credential.response
  if (!isAttestationResponse(response)) {
    throw new Error('Passkey 凭证类型不正确')
  }

  return {
    id: credential.id,
    type: credential.type,
    rawId: encodeBase64Url(credential.rawId),
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      attestationObject: encodeBase64Url(response.attestationObject),
      transports:
        typeof response.getTransports === 'function'
          ? response.getTransports()
          : [],
    },
  }
}

export function serializeAssertionCredential(
  credential: PublicKeyCredential,
): Record<string, unknown> {
  const response = credential.response
  if (!isAssertionResponse(response)) {
    throw new Error('Passkey 凭证类型不正确')
  }

  return {
    id: credential.id,
    type: credential.type,
    rawId: encodeBase64Url(credential.rawId),
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      authenticatorData: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle
        ? encodeBase64Url(response.userHandle)
        : null,
    },
  }
}

export async function runPasskeyAssertion(
  assertionOptions: unknown,
): Promise<Record<string, unknown>> {
  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    typeof navigator.credentials.get !== 'function'
  ) {
    throw new Error('当前浏览器不支持 Passkey 登录')
  }

  const publicKey = toPublicKeyRequestOptions(assertionOptions)
  const credential = await navigator.credentials.get({ publicKey })

  if (!credential) {
    throw new Error('Passkey 验证已取消')
  }
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey 凭证无效')
  }

  return serializeAssertionCredential(credential)
}

export async function runPasskeyRegistration(
  creationOptions: unknown,
): Promise<Record<string, unknown>> {
  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    typeof navigator.credentials.create !== 'function'
  ) {
    throw new Error('当前浏览器不支持 Passkey')
  }

  const publicKey = toPublicKeyCreationOptions(creationOptions)
  const credential = await navigator.credentials.create({ publicKey })

  if (!credential) {
    throw new Error('Passkey 创建已取消')
  }
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey 凭证无效')
  }

  return serializeAttestationCredential(credential)
}
