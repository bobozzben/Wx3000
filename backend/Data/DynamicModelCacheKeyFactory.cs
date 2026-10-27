using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Wx3000.Backend.Data
{
    public class DynamicModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
        {
            if (context is AppDbContext appDbContext)
            {
                return (context.GetType(), appDbContext.CurrentPgSchema, designTime);
            }
            return (context.GetType(), designTime);
        }
    }
}
