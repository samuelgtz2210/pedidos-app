import Cuenta from "./Cuenta";

type Props = { params: Promise<{ negocio: string }> };

export default async function PaginaCuenta({ params }: Props) {
  const { negocio } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Cuenta slug={negocio} />
    </main>
  );
}