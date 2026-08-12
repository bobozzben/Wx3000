using Wx3000.Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Product> Products => Set<Product>();
        public DbSet<Vendor> Vendors => Set<Vendor>();
        public DbSet<PurchaseHeader> PurchaseHeaders => Set<PurchaseHeader>();
        public DbSet<PurchaseLine> PurchaseLines => Set<PurchaseLine>();
        public DbSet<CpaMaster> CpaMasters => Set<CpaMaster>();
        public DbSet<EmpMaster> EmpMasters => Set<EmpMaster>();
        public DbSet<TaxOfficerMaster> TaxOfficerMasters => Set<TaxOfficerMaster>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<PurchaseHeader>()
                .HasIndex(p => p.BillNo)
                .IsUnique();

            modelBuilder.Entity<PurchaseHeader>()
                .HasMany(h => h.Lines)
                .WithOne(l => l.Header)
                .HasForeignKey(l => l.HeaderId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
