import { useEffect, useState } from 'react';

export const useUserListToggle = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/session')
      .then(res => res.json())
      .then(session => {
        if (!session.loggedIn) setVisible(false);
      })
      .catch(() => setVisible(false));
  }, []);

  const toggle = async () => {
    if (!loaded) {
      const res = await fetch('/api/users');
      const users = await res.json();
      setUsers(users);
      setLoaded(true);
    }
    setVisible(v => !v);
  };

  return { users, visible, toggle };
};
