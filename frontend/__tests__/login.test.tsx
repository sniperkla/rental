import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../app/login/page';

// Mock useRouter from next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: jest.fn(),
    };
  },
}));

// Mock useAuth from @/lib/auth
jest.mock('@/lib/auth', () => ({
  useAuth() {
    return {
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
    };
  },
}));

describe('Login Page', () => {
  it('renders login heading and description', () => {
    render(<LoginPage />);
    expect(screen.getByText('Welcome back 👋')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your admin dashboard')).toBeInTheDocument();
  });

  it('renders email and password inputs', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Sign in →' })).toBeInTheDocument();
  });
});
