using Wx3000.Backend.Models;
using Wx3000.Backend.Services;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Data
{
    public class AppDbContext : DbContext
    {
        private readonly ISystemConfigService? _configService;

        public string CurrentPgSchema => _configService?.CurrentPgSchema ?? "c:/w3000/comm";

        public AppDbContext(DbContextOptions<AppDbContext> options, ISystemConfigService? configService = null) 
            : base(options)
        {
            _configService = configService;
        }

        public DbSet<Product> Products => Set<Product>();
        public DbSet<Vendor> Vendors => Set<Vendor>();
        public DbSet<PurchaseHeader> PurchaseHeaders => Set<PurchaseHeader>();
        public DbSet<PurchaseLine> PurchaseLines => Set<PurchaseLine>();
        public DbSet<CpaMaster> CpaMasters => Set<CpaMaster>();
        public DbSet<EmpMaster> EmpMasters => Set<EmpMaster>();
        public DbSet<TaxOfficerMaster> TaxOfficerMasters => Set<TaxOfficerMaster>();
        public DbSet<CompanyMaster> CompanyMasters => Set<CompanyMaster>();
        public DbSet<FeeItemMaster> FeeItemMasters => Set<FeeItemMaster>();
        public DbSet<FeeSummaryMaster> FeeSummaryMasters => Set<FeeSummaryMaster>();
        public DbSet<NoteMaster> NoteMasters => Set<NoteMaster>();
        public DbSet<TicketPlaceMaster> TicketPlaceMasters => Set<TicketPlaceMaster>();
        public DbSet<InvoicePurchaseMaster> InvoicePurchaseMasters => Set<InvoicePurchaseMaster>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            var schema = CurrentPgSchema;

            modelBuilder.Entity<CpaMaster>().ToTable("cpa", schema);
            modelBuilder.Entity<EmpMaster>().ToTable("keyin", schema);
            modelBuilder.Entity<TaxOfficerMaster>().ToTable("taxno", schema);
            modelBuilder.Entity<CompanyMaster>().ToTable("customer", schema);
            modelBuilder.Entity<FeeItemMaster>().ToTable("recitem", schema);
            modelBuilder.Entity<FeeSummaryMaster>().ToTable("recnote", schema);
            modelBuilder.Entity<NoteMaster>().ToTable("recmemo", schema);
            modelBuilder.Entity<TicketPlaceMaster>().ToTable("place", schema);
            modelBuilder.Entity<InvoicePurchaseMaster>().ToTable("buyinv", schema);

            modelBuilder.Entity<InvoicePurchaseMaster>()
                .HasKey(i => new { i.Period, i.Times, i.CompanyCode });

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
