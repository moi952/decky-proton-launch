import { useTranslation } from "react-i18next";

const TitleSection: React.FC<{ title: string; icon?: React.ReactNode }> = ({
  title,
  icon,
}) => {
  const { t } = useTranslation("categories");

  return (
    <div
      style={{
        textTransform: "uppercase",
        fontSize: "0.9em",
        fontWeight: 700,
        letterSpacing: "0.1em",
        paddingBottom: "0.5em",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {icon && icon}
      {t(title)}
    </div>
  );
};

export default TitleSection;
