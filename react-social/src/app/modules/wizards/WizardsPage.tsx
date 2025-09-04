import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { PageLink, PageTitle } from "../../../_metronic/layout/core";
import { Horizontal } from "./components/Horizontal";
import { Vertical } from "./components/Vertical";

const wizardsBreadCrumbs: Array<PageLink> = [
  {
    title: "Wizards",
    path: "/crafted/pages/wizards/horizontal",
    isSeparator: false,
    isActive: false,
  },
  {
    title: "",
    path: "",
    isSeparator: true,
    isActive: false,
  },
];

const WizardsPage = () => (
  <Routes>
    <Route element={<Outlet />}>
      <Route
        path="horizontal"
        element={
          <>
            <PageTitle breadcrumbs={wizardsBreadCrumbs}>Horizontal</PageTitle>
            <Horizontal />
          </>
        }
      />
      <Route
        path="vertical"
        element={
          <>
            <PageTitle breadcrumbs={wizardsBreadCrumbs}>Vertical</PageTitle>
            <Vertical />
          </>
        }
      />
      <Route
        index
        element={<Navigate to="/crafted/pages/wizards/horizontal" />}
      />
    </Route>
  </Routes>
);

export default WizardsPage;
