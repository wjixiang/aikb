import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ItemsLayout } from "@/components/items/ItemsLayout";
import { ItemDetailRoute } from "@/components/items/ItemDetailRoute";
import { PreviewRoute } from "@/components/items/PreviewRoute";
import { TagsPage } from "@/components/TagsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route index element={<Navigate to="/items" replace />} />
        <Route path="/items" element={<ItemsLayout />}>
          <Route path=":itemId" element={<ItemDetailRoute />} />
          <Route path=":itemId/preview/:attId" element={<PreviewRoute />} />
        </Route>
        <Route path="/tags" element={<TagsPage />} />
      </Routes>
    </Layout>
  );
}
