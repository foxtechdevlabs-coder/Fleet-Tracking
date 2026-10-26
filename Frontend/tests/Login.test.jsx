import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Login from "../src/Components/Login/Login";

const login = vi.fn();
const clearAuthError = vi.fn();

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login,
    clearAuthError
  })
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderLogin(initialEntries = ["/login"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/device-vehicle" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  login.mockReset();
  clearAuthError.mockReset();
});

afterEach(cleanup);

describe("Login UI", () => {
  it("shows required validation messages without calling the API", () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before submission", () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    renderLogin();
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("prevents duplicate submissions while login is pending", async () => {
    let resolveLogin;
    login.mockImplementation(() => new Promise((resolve) => { resolveLogin = resolve; }));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });

    const button = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/device-vehicle"));
  });

  it("shows authentication API errors", async () => {
    login.mockRejectedValueOnce(new Error("Email or password is incorrect."));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
  });
});