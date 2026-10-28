/** "admin1" style logins map to the store's email domain. */
export const loginToEmail = (login: string) =>
  login.includes("@") ? login.trim() : `${login.trim().toLowerCase()}@proteinestore.ma`;
