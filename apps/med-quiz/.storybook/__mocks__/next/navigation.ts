// Mock next/navigation module
const mockRouter = {
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  pathname: '/',
};

export function useRouter() {
  return mockRouter;
}

export function usePathname() {
  return '/';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export default {
  useRouter,
  usePathname,
  useSearchParams,
  useParams
};