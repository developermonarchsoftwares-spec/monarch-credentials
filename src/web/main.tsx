import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "@/lib/auth";
import { SiteLayout } from "@/components/site";
import { Home } from "@/pages/Home";
import { Verify } from "@/pages/Verify";
import { Certificate } from "@/pages/Certificate";
import { Issuer } from "@/pages/Issuer";
import { Privacy, Terms } from "@/pages/Legal";
import { NotFound } from "@/pages/NotFound";
import { Login } from "@/pages/admin/Login";
import { AdminLayout } from "@/pages/admin/Layout";
import { Dashboard } from "@/pages/admin/Dashboard";
import { Certificates } from "@/pages/admin/Certificates";
import { CertificateNew } from "@/pages/admin/CertificateNew";
import { CertificateDetail } from "@/pages/admin/CertificateDetail";
import { Students, StudentDetail } from "@/pages/admin/Students";
import { Issuers } from "@/pages/admin/Issuers";
import { Users } from "@/pages/admin/Users";
import { Audit } from "@/pages/admin/Audit";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="verify" element={<Verify />} />
            <Route path="certificate/:certificateId" element={<Certificate />} />
            <Route path="issuers/:slug" element={<Issuer />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="certificates/new" element={<CertificateNew />} />
            <Route path="certificates/:certificateId" element={<CertificateDetail />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="issuers" element={<Issuers />} />
            <Route path="users" element={<Users />} />
            <Route path="audit" element={<Audit />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
