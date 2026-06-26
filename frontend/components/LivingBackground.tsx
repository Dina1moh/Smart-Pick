export default function LivingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Lavender */}
      <div
        className="animate-blob-1 absolute -top-32 -left-24 h-[34rem] w-[34rem] rounded-full blur-[120px]"
        style={{ background: "rgba(124, 108, 255, 0.22)" }}
      />
      {/* Sky blue */}
      <div
        className="animate-blob-2 absolute top-1/3 -right-28 h-[32rem] w-[32rem] rounded-full blur-[120px]"
        style={{ background: "rgba(114, 221, 247, 0.20)" }}
      />
      {/* Soft pink */}
      <div
        className="animate-blob-3 absolute -bottom-40 left-1/4 h-[30rem] w-[30rem] rounded-full blur-[120px]"
        style={{ background: "rgba(255, 183, 213, 0.20)" }}
      />
    </div>
  );
}
