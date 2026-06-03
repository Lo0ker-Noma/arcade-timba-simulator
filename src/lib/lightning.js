// Lightning helpers — Option A ("hackathon-friendly" escrow).
//
// Each player funds the pot by paying an invoice generated from the room's
// escrow Lightning Address (the room creator's address). When the match ends,
// the winner is paid by resolving THEIR Lightning Address into an invoice for
// the full pot, which the escrow holder pays (via WebLN if available, else a
// QR/copyable invoice they pay manually).
//
// This is intentionally non-custodial-but-trust-based: simple, no backend.
// A future Option B (LNbits/Strike ephemeral wallet) can replace resolvePayout.

// Validate a Lightning Address (user@domain), conservative charset.
export function isValidLightningAddress(addr) {
  if (typeof addr !== 'string') return false;
  const trimmed = addr.trim().toLowerCase();
  return /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed) && trimmed.length <= 120;
}

// Resolve a Lightning Address to its LNURL-pay params (LUD-16).
export async function resolveLnurlPay(address) {
  if (!isValidLightningAddress(address)) throw new Error('Lightning address inválida');
  const [name, domain] = address.trim().toLowerCase().split('@');
  const url = `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`No se pudo resolver ${address} (HTTP ${res.status})`);
  const data = await res.json();
  if (data.status === 'ERROR') throw new Error(data.reason || 'LNURL error');
  if (data.tag !== 'payRequest' || typeof data.callback !== 'string') {
    throw new Error('Respuesta LNURL-pay inválida');
  }
  return {
    callback: data.callback,
    minSendable: Number(data.minSendable) || 1000,
    maxSendable: Number(data.maxSendable) || 100000000000,
    metadata: data.metadata || '',
    commentAllowed: Number(data.commentAllowed) || 0,
  };
}

// Request a BOLT11 invoice for `sats` from resolved LNURL-pay params.
export async function requestInvoice(address, sats, comment = '') {
  const params = await resolveLnurlPay(address);
  const msat = Math.round(sats * 1000);
  if (msat < params.minSendable || msat > params.maxSendable) {
    throw new Error(`Monto fuera de rango (${params.minSendable / 1000}–${params.maxSendable / 1000} sats)`);
  }
  const cb = new URL(params.callback);
  cb.searchParams.set('amount', String(msat));
  if (comment && params.commentAllowed > 0) {
    cb.searchParams.set('comment', comment.slice(0, params.commentAllowed));
  }
  const res = await fetch(cb.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Error generando factura (HTTP ${res.status})`);
  const data = await res.json();
  if (data.status === 'ERROR') throw new Error(data.reason || 'No se pudo generar la factura');
  if (typeof data.pr !== 'string' || !/^ln[a-z0-9]+$/i.test(data.pr)) {
    throw new Error('Factura BOLT11 inválida');
  }
  return data.pr; // bolt11 invoice string
}

// Detect WebLN (Alby / native browser Lightning).
export function hasWebLN() {
  return typeof window !== 'undefined' && !!window.webln;
}

// Pay a BOLT11 invoice via WebLN. Returns { preimage } on success.
export async function payWithWebLN(bolt11) {
  if (!hasWebLN()) throw new Error('WebLN no disponible (instala Alby u otra wallet)');
  await window.webln.enable();
  const res = await window.webln.sendPayment(bolt11);
  return res; // { preimage, ... }
}

// Full convenience flow: resolve address -> invoice -> pay via WebLN.
export async function payAddress(address, sats, comment = '') {
  const invoice = await requestInvoice(address, sats, comment);
  if (hasWebLN()) {
    const res = await payWithWebLN(invoice);
    return { paid: true, invoice, preimage: res?.preimage || null };
  }
  // No WebLN: caller shows the invoice as QR for manual payment.
  return { paid: false, invoice, preimage: null };
}
