import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ItemsPage } from "@/components/ItemsPage";
import { TagsPage } from "@/components/TagsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route index element={<Navigate to="/items" replace />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/tags" element={<TagsPage />} />
      </Routes>
    </Layout>
  );
}
