import { Redirect } from "expo-router";
import { useSession } from "../../components/session";
import { Loading } from "../../components/ui";
export default function Index() {
  const { user, loading } = useSession();
  return loading ? (
    <Loading />
  ) : (
    <Redirect href={user ? "/home" : "/auth/login"} />
  );
}
