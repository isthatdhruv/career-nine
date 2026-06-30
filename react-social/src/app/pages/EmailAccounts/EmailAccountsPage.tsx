import PageHeader from "../../components/PageHeader";
import EmailAccountsTable from "./components/EmailAccountsTable";
import InstituteEmailDefaults from "./components/InstituteEmailDefaults";

const EmailAccountsPage = () => {
  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-at-fill" />}
        title="Email Accounts"
        subtitle="Configure sender accounts, credentials and the global default provider"
      />
      <EmailAccountsTable />
      <InstituteEmailDefaults />
    </div>
  );
};

export default EmailAccountsPage;
