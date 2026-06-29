import PageHeader from "../../components/PageHeader";
import EmailAccountsTable from "./components/EmailAccountsTable";

const EmailAccountsPage = () => {
  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-at-fill" />}
        title="Email Accounts"
        subtitle="Configure sender accounts, credentials and the global default provider"
      />
      <EmailAccountsTable />
    </div>
  );
};

export default EmailAccountsPage;
