'use client';

export default function UserList({ users, onSelectUser, selectedUser, darkMode }) {
  const bgColor = darkMode ? '#2d2d2d' : '#f0f0f0';
  const borderColor = darkMode ? '#444' : '#e0e0e0';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const mutedText = darkMode ? '#888' : '#999';
  const selectedBg = darkMode ? '#404040' : '#e8f0ff';
  const hoverBg = darkMode ? '#3a3a3a' : '#f5f5f5';

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      borderBottom: `1px solid ${borderColor}`,
      background: bgColor
    }}>
      {users.length === 0 ? (
        <div style={{
          padding: '1rem',
          color: mutedText,
          textAlign: 'center',
          fontSize: '0.9rem'
        }}>
          No users available
        </div>
      ) : (
        users.map((user) => (
          <div
            key={user.uid}
            onClick={() => onSelectUser(user)}
            style={{
              padding: '1rem',
              borderBottom: `1px solid ${borderColor}`,
              cursor: 'pointer',
              background: selectedUser?.uid === user.uid ? selectedBg : 'transparent',
              transition: 'background 0.2s',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (selectedUser?.uid !== user.uid) {
                e.currentTarget.style.background = hoverBg;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = selectedUser?.uid === user.uid ? selectedBg : 'transparent';
            }}
          >
            <div style={{
              fontSize: '0.95rem',
              fontWeight: '500',
              color: textColor,
              marginBottom: '0.2rem'
            }}>
              👤 {user.displayName}
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: mutedText,
              marginTop: '0.2rem'
            }}>
              {user.email}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
