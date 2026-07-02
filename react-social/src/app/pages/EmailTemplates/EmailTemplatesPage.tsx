import PageHeader from "../../components/PageHeader";
import EmailTemplatesTable from "./components/EmailTemplatesTable";




const EmailTemplatesPage = () => {
  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-paper-fill" />}
        title="Email Templates"
        subtitle="Reusable subjects + HTML bodies with placeholders, one default per send-scenario"
      />
      <EmailTemplatesTable />
    </div>
  );
};

export default EmailTemplatesPage;
