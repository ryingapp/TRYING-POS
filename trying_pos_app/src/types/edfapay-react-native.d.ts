/**
 * Type declarations for the EdfaPay React Native SDK.
 * The actual module is installed from EdfaPay's private Maven/npm registry.
 * When not installed, the service falls back to demo mode.
 */
declare module 'edfapay-react-native' {
  export const EdfaPayPlugin: any;
  export const TransactionType: any;
  export const FlowType: any;
  export const Env: any;
  export const Presentation: any;
  export const PurchaseSecondaryAction: any;
  const _default: any;
  export default _default;
}
