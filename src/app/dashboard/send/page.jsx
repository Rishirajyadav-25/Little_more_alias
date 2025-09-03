

'use client'
import { Suspense } from 'react'
import SendEmail from './SendEmail.js'   // 👈 this is your existing component

export default function SendPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SendEmail />
    </Suspense>
  )
}










// 'use client';
// import { useState, useEffect } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import Link from 'next/link';

// export default function SendEmail() {
//   const [formData, setFormData] = useState({
//     to: '',
//     subject: '',
//     message: ''
//   });
//   const [aliases, setAliases] = useState([]);
//   const [selectedAlias, setSelectedAlias] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   useEffect(() => {
//     fetchAliases();
//     const aliasFromQuery = searchParams.get('alias');
//     if (aliasFromQuery) {
//       setSelectedAlias(aliasFromQuery);
//     }
//   }, [searchParams]);

//   const fetchAliases = async () => {
//     try {
//       const response = await fetch('/api/aliases');
//       if (response.ok) {
//         const aliasData = await response.json();
//         setAliases(aliasData);
//       }
//     } catch (error) {
//       console.error('Error fetching aliases:', error);
//     }
//   };

//   const sendEmail = async (e) => {
//     e.preventDefault();
//     setError('');
//     setSuccess('');
//     setLoading(true);

//     try {
//       const response = await fetch('/api/send-email', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           from: selectedAlias,
//           to: formData.to,
//           subject: formData.subject,
//           text: formData.message
//         })
//       });

//       if (response.ok) {
//         setSuccess('Email sent successfully!');
//         setFormData({ to: '', subject: '', message: '' });
//       } else {
//         const data = await response.json();
//         setError(data.error || 'Failed to send email');
//       }
//     } catch (error) {
//       setError('Network error. Please try again.');
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="container" style={{ paddingTop: '40px' }}>
//       <div style={{ marginBottom: '20px' }}>
//         <Link href="/dashboard" style={{ color: '#3b82f6' }}>← Back to Dashboard</Link>
//       </div>

//       <div className="card">
//         <h2 style={{ marginBottom: '24px' }}>Send Email</h2>

//         {error && <div className="alert alert-error">{error}</div>}
//         {success && <div className="alert alert-success">{success}</div>}

//         <form onSubmit={sendEmail}>
//           <div style={{ marginBottom: '16px' }}>
//             <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
//               From (Alias):
//             </label>
//             <select
//               className="input"
//               value={selectedAlias}
//               onChange={(e) => setSelectedAlias(e.target.value)}
//               required
//             >
//               <option value="">Select an alias</option>
//               {aliases.map((alias) => (
//                 <option key={alias._id} value={alias.aliasEmail}>
//                   {alias.aliasEmail}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div style={{ marginBottom: '16px' }}>
//             <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
//               To:
//             </label>
//             <input
//               type="email"
//               className="input"
//               value={formData.to}
//               onChange={(e) => setFormData({...formData, to: e.target.value})}
//               placeholder="recipient@example.com"
//               required
//             />
//           </div>

//           <div style={{ marginBottom: '16px' }}>
//             <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
//               Subject:
//             </label>
//             <input
//               type="text"
//               className="input"
//               value={formData.subject}
//               onChange={(e) => setFormData({...formData, subject: e.target.value})}
//               placeholder="Email subject"
//               required
//             />
//           </div>

//           <div style={{ marginBottom: '24px' }}>
//             <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
//               Message:
//             </label>
//             <textarea
//               className="input"
//               value={formData.message}
//               onChange={(e) => setFormData({...formData, message: e.target.value})}
//               placeholder="Your message here..."
//               rows="6"
//               required
//               style={{ resize: 'vertical' }}
//             />
//           </div>

//           <button 
//             type="submit" 
//             className="btn btn-primary"
//             disabled={loading}
//           >
//             {loading ? 'Sending...' : 'Send Email'}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }