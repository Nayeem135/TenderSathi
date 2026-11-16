// LogoutButton: forgets the token and goes to the login page.
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import Button from "./Button";

export default function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleClick() {
    logout();
    navigate("/login");
  }

  return (
    <Button variant="secondary" onClick={handleClick}>
      Log out
    </Button>
  );
}
