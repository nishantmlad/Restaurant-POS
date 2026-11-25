import OrderStatusDisplayPage from "../page";

export default async function OrderStatusBranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  return <OrderStatusDisplayPage initialBranchId={branchId} />;
}

