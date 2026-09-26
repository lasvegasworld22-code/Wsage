export function walletAgent(agents, wallet) {
  if (!wallet) return null;
  // Deterministic primary identity for legacy wallets; never discard older records.
  return agents.filter(a => a.creatorWallet === wallet.id && !a.deletedAt)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id))[0] || null;
}