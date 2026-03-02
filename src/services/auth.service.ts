class AuthService {
  private fakePremiumUser = {
    uid: "local-premium-user",
    email: "free@user.local",
    displayName: "Premium User",
    emailVerified: true,
    id: 1,
    userName: "Premium User",
    status: "active",
    subscription_status: "active",
    current_subscription: {
      plan: "pro",
      status: "active",
    },
  };

  private authStateListeners: any[] = [];

  constructor() {}

  async init() {
    this.notifyAuthStateChange(this.fakePremiumUser);
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.authStateListeners.push(callback);
    callback(this.fakePremiumUser);
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  notifyAuthStateChange(user: any) {
    this.authStateListeners.forEach((listener) => listener(user));
  }

  async login(email: string, password: string, remember: boolean = false) {
    return { user: this.fakePremiumUser, token: "fake-token" };
  }

  async register(data: any) {
    return { user: this.fakePremiumUser, token: "fake-token" };
  }

  async googleLogin() {
    return { user: this.fakePremiumUser, token: "fake-token" };
  }

  async googleRegister() {
    return this.googleLogin();
  }

  async sendVerificationCode(email: string) {
    return true;
  }

  async sendPasswordResetCode(email: string) {
    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    return true;
  }

  async verifyCode(email: string, code: string) {
    return true;
  }

  async logout() {
    // Cannot logout, always premium
    return true;
  }

  async getUserInfo(refresh = false) {
    return this.fakePremiumUser;
  }

  getCurrentUser() {
    return this.fakePremiumUser;
  }

  isAuthenticated() {
    return true;
  }

  async isAuthenticatedAsync() {
    return true;
  }

  getStoredUserInfo() {
    return this.fakePremiumUser;
  }

  async getStoredUserInfoAsync() {
    return this.fakePremiumUser;
  }

  getToken() {
    return "fake-token";
  }

  async getTokenAsync() {
    return "fake-token";
  }
}

export const authService = new AuthService();
