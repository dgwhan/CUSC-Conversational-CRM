import React from 'react';
import { HeaderLayout, type HeaderLayoutProps } from '../layouts/HeaderLayout.js';

export type NavbarProps = HeaderLayoutProps;

/**
 * @deprecated Khuyến khích sử dụng HeaderLayout từ `src/layouts/HeaderLayout.tsx`
 * để chỉnh sửa header dạng layout riêng biệt.
 */
export const Navbar: React.FC<NavbarProps> = (props) => {
  return <HeaderLayout {...props} />;
};
