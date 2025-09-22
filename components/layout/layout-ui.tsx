export const BodyContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='flex p-0 overflow-x-auto min-h-screen pt-20'>
      {children}
    </div>
  );
};
