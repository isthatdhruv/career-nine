import { ConnectedAccounts } from "./cards/ConnectedAccounts";
import { DeactivateAccount } from "./cards/DeactivateAccount";
import { EmailPreferences } from "./cards/EmailPreferences";
import { Notifications } from "./cards/Notifications";
import { ProfileDetails } from "./cards/ProfileDetails";
import { SignInMethod } from "./cards/SignInMethod";

export function Settings() {
  return (
    <>
      <ProfileDetails />
      <SignInMethod />
      <ConnectedAccounts />
      <EmailPreferences />
      <Notifications />
      <DeactivateAccount />
    </>
  );
}
