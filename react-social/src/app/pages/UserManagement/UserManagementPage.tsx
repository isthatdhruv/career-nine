import PageHeader from "../../components/PageHeader";
import RegisteredUsersTab from "./components/RegisteredUsersTab";

const UserManagementPage = () => {
  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-people-fill" />}
        title="User Management"
        subtitle="Manage users, role group assignments, and institute access"
      />
      {/* Users table with all actions */}
      <RegisteredUsersTab />
    </div>
  );
};

export default UserManagementPage;
