type ProfileMediaProps = {
  video: string;
  poster: string;
};

export function ProfileMedia({ video, poster }: ProfileMediaProps) {
  return (
    <div className="relative w-[200px] h-[200px] overflow-hidden rounded-t-full [corner-shape:superellipse(1.2)]">
      <video
        src={video}
        poster={poster}
        preload="metadata"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
    </div>
  );
}
