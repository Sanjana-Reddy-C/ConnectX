interface ButtonProps {
  title: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

function Button({
  title,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="w-full rounded-lg bg-cyan-500 py-3 font-semibold text-white transition hover:bg-cyan-600"
    >
      {title}
    </button>
  );
}

export default Button;