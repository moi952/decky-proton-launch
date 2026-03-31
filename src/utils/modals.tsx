import { showModal } from "@decky/ui";
import { AppProvider } from "../context/AppProvider";
import { FavoriteModalContent } from "../components/ButtonFavoriteModal";
import { DeleteFavoriteModalContent } from "../components/ButtonDeleteFavoriteModal";
import { DeleteCustomVariableModalContent } from "../components/ButtonDeleteCustomVariableModal";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";

export const openFavoriteModal = (params: {
  variableName: string;
  env: string;
  value: string;
}) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <FavoriteModalContent
        variableName={params.variableName}
        env={params.env}
        value={params.value}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};

export const openDeleteFavoriteModal = (title: string) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <DeleteFavoriteModalContent
        title={title}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};

export const openGenericDeleteModal = (params: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <ConfirmDeleteModal
      title={params.title}
      description={params.description}
      confirmLabel={params.confirmLabel}
      onConfirm={params.onConfirm}
      onClose={() => modal?.Close()}
    />,
  );
};

export const openDeleteCustomVariableModal = (id: string, name: string) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <DeleteCustomVariableModalContent
        id={id}
        name={name}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};
