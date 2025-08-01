import { LogoHover } from "@/components/logo/logo-hover";

export default function Home() {
  return (
    <div className="flex size-full items-center justify-center">
      <div className="font-departureMono flex items-center gap-4 text-3xl font-medium tracking-tighter">
        <LogoHover size="lg" forceAnimate />
        Code with{" "}
        <span className="text-muted-foreground inline-flex items-center gap-2">
          Shadow
        </span>
      </div>
    </div>
  );
}
