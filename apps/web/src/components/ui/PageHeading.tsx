type PageHeadingProps = {
  title: string;
  description?: string;
  level?: "h1" | "h2" | "h3";
};

export function PageHeading({
  title,
  description,
  level = "h1",
}: PageHeadingProps) {
  const Heading = level;

  return (
    <header className="flex flex-col gap-2">
      <Heading className="m-0 font-sans text-display font-semibold tracking-tight text-text-primary">
        {title}
      </Heading>
      {description && (
        <p className="m-0 font-sans text-body text-text-secondary">
          {description}
        </p>
      )}
    </header>
  );
}
