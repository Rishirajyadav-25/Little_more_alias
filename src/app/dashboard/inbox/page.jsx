'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Inbox() {
  const [emails, setEmails] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pagination, setPagination] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  useEffect(() => {
    fetchEmails();
    fetchAliases();
  }, [currentPage, selectedAlias, unreadOnly]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });
      
      if (selectedAlias) params.append('alias', selectedAlias);
      if (unreadOnly) params.append('unread', 'true');

      const response = await fetch(`/api/inbox?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails);
        setPagination(data.pagination);
        setUnreadCount(data.unreadCount);
      } else if (response.status === 401) {
        router.push('/signin');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
    setLoading(false);
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

  const markAsRead = async (emailId, isRead) => {
    try {
      const response = await fetch(`/api/inbox/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead })
      });

      if (response.ok) {
        fetchEmails(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating email:', error);
    }
  };

  const deleteEmail = async (emailId) => {
    if (!confirm('Are you sure you want to delete this email?')) return;

    try {
      const response = await fetch(`/api/inbox/${emailId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchEmails(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting email:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays <= 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '80px', textAlign: 'center' }}>
        <p>Loading inbox...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/dashboard" style={{ color: '#3b82f6' }}>← Back to Dashboard</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1>
          Inbox 
          {unreadCount > 0 && (
            <span style={{ 
              background: '#ef4444', 
              color: 'white', 
              borderRadius: '12px', 
              padding: '4px 8px', 
              fontSize: '12px',
              marginLeft: '8px'
            }}>
              {unreadCount}
            </span>
          )}
        </h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: '8px' }}>Filter by alias:</label>
            <select
              value={selectedAlias}
              onChange={(e) => {
                setSelectedAlias(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="">All aliases</option>
              {aliases.map((alias) => (
                <option key={alias._id} value={alias.aliasEmail}>
                  {alias.aliasEmail}
                </option>
              ))}
            </select>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setCurrentPage(1);
              }}
              style={{ marginRight: '8px' }}
            />
            Show unread only
          </label>
        </div>
      </div>

      {/* Email List */}
      <div className="card">
        {emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <p>No emails found.</p>
            {!unreadOnly && !selectedAlias && (
              <p style={{ marginTop: '16px' }}>
                Emails sent to your aliases will appear here and be forwarded to your real email.
              </p>
            )}
          </div>
        ) : (
          <div>
            {emails.map((email) => (
              <div 
                key={email._id} 
                style={{ 
                  borderBottom: '1px solid #e5e7eb',
                  padding: '16px 0',
                  backgroundColor: email.isRead ? 'transparent' : '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: email.isRead ? '#374151' : '#1f2937' }}>
                          {email.from}
                        </strong>
                        {!email.isRead && (
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: '#3b82f6' 
                          }} />
                        )}
                      </div>
                      <span style={{ color: '#6b7280', fontSize: '14px', marginLeft: 'auto' }}>
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '4px', fontSize: '14px', color: '#6b7280' }}>
                      To: {email.aliasEmail}
                    </div>
                    
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ 
                        fontWeight: email.isRead ? 'normal' : 'bold',
                        color: email.isRead ? '#374151' : '#1f2937'
                      }}>
                        {email.subject}
                      </span>
                    </div>
                    
                    <div style={{ color: '#6b7280', fontSize: '14px' }}>
                      {email.bodyPlain.substring(0, 150)}
                      {email.bodyPlain.length > 150 && '...'}
                    </div>

                    {email.attachments && email.attachments.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                        📎 {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button
                      onClick={() => router.push(`/dashboard/inbox/${email._id}`)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '14px' }}
                    >
                      View
                    </button>
                    
                    <button
                      onClick={() => markAsRead(email._id, !email.isRead)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '14px' }}
                    >
                      {email.isRead ? 'Unread' : 'Read'}
                    </button>
                    
                    <button
                      onClick={() => deleteEmail(email._id)}
                      className="btn"
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '14px',
                        backgroundColor: '#ef4444',
                        color: 'white'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '16px',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={!pagination.hasPrev}
              className="btn btn-secondary"
              style={{ 
                padding: '8px 16px',
                opacity: pagination.hasPrev ? 1 : 0.5,
                cursor: pagination.hasPrev ? 'pointer' : 'not-allowed'
              }}
            >
              Previous
            </button>
            
            <span style={{ color: '#6b7280' }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={!pagination.hasNext}
              className="btn btn-secondary"
              style={{ 
                padding: '8px 16px',
                opacity: pagination.hasNext ? 1 : 0.5,
                cursor: pagination.hasNext ? 'pointer' : 'not-allowed'
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
