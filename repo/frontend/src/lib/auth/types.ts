export type SessionUser = {
  sub: string;
  username: string;
  roles: string[];
};

export type AuthSession = {
  user: SessionUser;
};
