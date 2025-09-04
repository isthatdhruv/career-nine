import axios from 'axios';
import { useState } from 'react';

function EmailVerification() {
  const [email, setEmail] = useState('');
  const [otp, setOTP] = useState('');

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handleOTPChange = (event) => {
    setOTP(event.target.value);
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post('/api/verify-email', { email, otp });
      // TODO: Handle success case
    } catch (error) {
      // console.log(error.response.data);
      // TODO: Handle error case
    }
  };

  return (
    <div>
      <h1>Email Verification with OTP</h1>
      <form onSubmit={handleVerify}>
        <label>
          Email:
          <input type="email" value={email} onChange={handleEmailChange} />
        </label>
        <br />
        <label>
          OTP:
          <input type="text" value={otp} onChange={handleOTPChange} />
        </label>
        <br />
        <button type="submit">Verify Email</button>
      </form>
    </div>
  );
}

export default EmailVerification;
