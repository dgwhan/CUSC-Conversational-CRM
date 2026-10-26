import React from 'react';
import '../App.css';
import { MainLayout, type MainLayoutProps } from '../layouts/MainLayout.js';

export type AppLayoutProps = MainLayoutProps;

/**
 * AppLayout kết nối MainLayout để duy trì tương thích.
 * Tách biệt Header/Navbar thành layout độc lập.
 */
export const AppLayout: React.FC<AppLayoutProps> = (props) => {
  return <MainLayout {...props} />;
};
