import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <div style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '24px', color: '#1f2937' }}>
          Email Alias Service
        </h1>
        <p style={{ fontSize: '20px', color: '#6b7280', marginBottom: '48px' }}>
          Create and manage professional email aliases with ease
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/signin">
            <button className="btn btn-primary">Sign In</button>
          </Link>
          <Link href="/register">
            <button className="btn btn-secondary">Register</button>
          </Link>
        </div>
      </div>
    </div>
  );
}