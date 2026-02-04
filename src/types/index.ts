/**
 * Type Exports
 *
 * Re-exports all type definitions for convenient importing.
 */

export type {
  UserInfo,
  CheckAuthResponse,
  TokenResponse,
  AuthErrorType,
  AuthError,
  BackendAuthError,
  BackendTokenResponse,
  LogoutResponse,
  DecodedAccessToken,
  TwoFactorErrorCode,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
  TwoFactorResendResponse,
  TwoFactorErrorResponse
} from './auth'

export type { BffAuthPluginOptions, BffAuthConfig, AuthIcons } from './config'
