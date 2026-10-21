export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="container-x flex justify-center py-12 sm:py-20">
      <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
    </div>
  );
}
