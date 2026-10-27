using Wx3000.Backend.Data;
using Wx3000.Backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.FileProviders;

var options = new WebApplicationOptions
{
    Args = args,
    ContentRootPath = WindowsServiceHelpers.IsWindowsService() ? AppContext.BaseDirectory : default
};
var builder = WebApplication.CreateBuilder(options);

// Add Windows Service Hosting support
builder.Host.UseWindowsService();
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "Wx3000Api";
});

// Configure listening URL (Default: http://0.0.0.0:5007 to support LAN workstations)
var listenUrls = builder.Configuration["Urls"] ?? "http://0.0.0.0:5007";
builder.WebHost.UseUrls(listenUrls);

// PostgreSQL Connection String
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=54320;Database=w3000;Username=postgres;Password=Pg_W3000";

// Register HttpContextAccessor
builder.Services.AddHttpContextAccessor();

// Register SystemConfigService
builder.Services.AddSingleton<ISystemConfigService, SystemConfigService>();

// Register EF Core PostgreSQL DbContext with dynamic model cache factory
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
    options.ReplaceService<IModelCacheKeyFactory, DynamicModelCacheKeyFactory>();
});

// Register SystemParamService
builder.Services.AddScoped<ISystemParamService, SystemParamService>();

// Register LocalAgent DBF Sync Service
var localAgentUrl = builder.Configuration["LocalAgent:Url"] ?? "http://localhost:18889";
builder.Services.AddHttpClient<IDbfSyncService, DbfSyncService>(client =>
{
    client.BaseAddress = new Uri(localAgentUrl);
    client.Timeout = TimeSpan.FromSeconds(60);
});

// Add CORS Policy for Frontend & ngrok
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Auto-create database & Seed initial mock data
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var configService = services.GetRequiredService<ISystemConfigService>();
        var context = services.GetRequiredService<AppDbContext>();
        DbInitializer.Initialize(context, configService.CurrentPgSchema);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "資料庫初始化建立失敗。");
    }
}

// Always enable Swagger for LAN server diagnostics
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Wx3000 API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

// System Health Endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// 靜態檔案託管與 SPA 支援 (讓 C# 後端可同時提供 Web 瀏覽器端與 Electron 客戶端)
var wwwrootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (Directory.Exists(wwwrootPath))
{
    var fileProvider = new PhysicalFileProvider(wwwrootPath);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });

    // SPA Fallback: 任何非 API 請求皆由 index.html 接管
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = fileProvider });
}

app.Run();
