import cron from "node-cron";
import { User } from "../models/users";

const subscriptionMonitor = () => {
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();
    console.log("Running subscription expiry check:", today);

    try {
      const expiredUsers = await User.find({
        "subscription.status": "Active",
        subscriptionExpiryDate: { $lt: today },
      });

      for (const user of expiredUsers) {
        user.subscription.status = "Inactive";
        user.subscription.plan = "Basic";
        user.listingLimit = 1; // Revert to a basic limit
        user.subscriptionExpiryDate = null;
        await user.save();
        console.log(`User ${user._id}'s subscription has expired.`);
      }

      // Optional: Logic for sending renewal reminders 5 days before expiry
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 5);
      const expiringUsers = await User.find({
        "subscription.status": "Active",
        subscriptionExpiryDate: { $gte: today, $lt: reminderDate },
      });
      for (const user of expiringUsers) {
        console.log(
          `Reminder: User ${user._id}'s subscription expires in 5 days.`
        );
        // Here, you would send an email or an in-app notification
      }
    } catch (error) {
      console.error("Error in subscription cron job:", error);
    }
  });
};

export default subscriptionMonitor;
