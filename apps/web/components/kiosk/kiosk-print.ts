// Direct hardware thermal printer: sends ESC/POS print job directly to the
// branch's thermal printer (USB/LAN/COM) without opening any browser print preview dialog.
export async function printKioskReceipt(
  token: string,
  orderNumber: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/v1/public/kiosk/${token}/print/${encodeURIComponent(orderNumber)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data?.success !== false;
    }
    return false;
  } catch {
    return false;
  }
}
