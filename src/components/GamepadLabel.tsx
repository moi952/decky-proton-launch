const GamepadLabel: React.FC<{
  text: string;
  icon: React.ReactNode;
}> = ({ text, icon }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    }}
  >
    {text}
    {icon}
  </span>
);

export default GamepadLabel;
