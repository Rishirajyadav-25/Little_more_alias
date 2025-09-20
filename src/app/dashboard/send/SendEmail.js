'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SendEmail() {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    message: ''
  });
  const [aliases, setAliases] = useState([]);
  const [sendableAliases, setSendableAliases] = useState([]);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchUser();
    fetchAliases();
    const aliasFromQuery = searchParams.get('alias');
    const replyToId = searchParams.get('reply');
    
    if (aliasFromQuery) {
      setSelectedAlias(aliasFromQuery);
    }
    
    if (replyToId) {
      fetchReplyData(replyToId);
    }
  }, [searchParams]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        setUser(await response.json());
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchAliases = async () => {
    try {
      const response = await fetch('/api/aliases');
      if (response.ok) {
        const aliasData = await response.json();
        setAliases(aliasData);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    }
  };

  const fetchReplyData = async (emailId) => {
    try {
      const response = await fetch(`/api/inbox/${emailId}`);
      if (response.ok) {
        const email = await response.json();
        setSelectedAlias(email.aliasEmail);
        setFormData({
          to: email.from,
          subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
          message: `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.aliasEmail}\nSubject: ${email.subject}\n\n${email.bodyPlain}`
        });
      }
    } catch (error) {
      console.error('Error fetching reply data:', error);
    }
  };

  // Filter sendable aliases after user and aliases load
  useEffect(() => {
    if (user && aliases.length > 0) {
      const filtered = aliases.filter(a => {
        if (!a.isCollaborative) return true; // Personal always sendable
        if (a.ownerId.toString() === user._id.toString()) return true; // Owner
        const collab = a.collaborators?.find(c => c.userId.toString() === user._id.toString());
        return collab && collab.role === 'member';
      });
      setSendableAliases(filtered);
    }
  }, [user, aliases]);

  const sendEmail = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: selectedAlias,
          to: formData.to,
          subject: formData.subject,
          text: formData.message
        })
      });

      if (response.ok) {
        setSuccess('Email sent successfully!');
        setFormData({ to: '', subject: '', message: '' });
        setSelectedAlias('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send email');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">← Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900">Send Email</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded mb-4">{success}</div>}

        <form onSubmit={sendEmail} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* From Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From (Alias)
            </label>
            <select
              value={selectedAlias}
              onChange={(e) => setSelectedAlias(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select an alias</option>
              {sendableAliases.map((alias) => (
                <option key={alias._id} value={alias.aliasEmail}>
                  {alias.aliasEmail} {alias.isCollaborative ? '(Collaborative)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* To Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
            </label>
            <input
              type="email"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.to}
              onChange={(e) => setFormData({...formData, to: e.target.value})}
              placeholder="recipient@example.com"
              required
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="Email subject"
              required
            />
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              rows={12}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-y"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Type your message here..."
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={loading || !selectedAlias}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Email'
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setFormData({ to: '', subject: '', message: '' })}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              {formData.message.length} characters
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}




