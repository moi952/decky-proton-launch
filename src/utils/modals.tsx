import { showModal } from "@decky/ui";
import { AppProvider } from "../context/AppProvider";
import { FavoriteModalContent } from "../components/ButtonFavoriteModal";
import { DeleteFavoriteModalContent } from "../components/ButtonDeleteFavoriteModal";
import { DeleteCustomVariableModalContent } from "../components/ButtonDeleteCustomVariableModal";

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
