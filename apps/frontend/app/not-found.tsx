import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-4">
      <h2 className="text-4xl font-bold font-departureMono">Not Found</h2>
      <p className="text-lg font-departureMono">We couldn't find the page you were looking for.</p>
      <Link href="/" className="text-lg text-blue-500/50 font-departureMono hover:text-blue-500 animate ease-out duration-150">Return Home</Link>
    </div>
  );
}